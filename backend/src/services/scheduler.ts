import cron from 'node-cron';
import db from '../db';
import { Schedule, StreamProfile } from '../types';
import { ffmpegManager } from './ffmpeg';
import { logger } from '../utils/logger';

class Scheduler {
  private task: cron.ScheduledTask | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    // Run every minute
    this.checkInterval = setInterval(() => this.tick(), 60 * 1000);
    logger.system('Scheduler started', 'Checking schedules every minute');
    // Run once on start
    setTimeout(() => this.tick(), 5000);
  }

  stop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.task) this.task.stop();
  }

  private tick() {
    try {
      const now = new Date();
      const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as Schedule[];

      for (const sched of schedules) {
        if (!this.shouldRun(sched, now)) continue;

        const profile = db.prepare('SELECT * FROM stream_profiles WHERE id = ?').get(sched.profile_id) as StreamProfile | undefined;
        if (!profile) continue;

        const isRunning = ffmpegManager.getActiveStream(profile.id);
        if (sched.auto_start && !isRunning) {
          logger.system(`Schedule "${sched.name}" starting stream "${profile.name}"`);
          ffmpegManager.start(profile).catch((e) => {
            logger.error(`Scheduled start failed for ${profile.name}`, String(e));
          });
        } else if (sched.auto_stop && isRunning && sched.stop_time) {
          // If current time is after stop time, stop
          const [stopH, stopM] = sched.stop_time.split(':').map(Number);
          const stopMinutes = stopH * 60 + stopM;
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (nowMinutes >= stopMinutes) {
            logger.system(`Schedule "${sched.name}" stopping stream "${profile.name}"`);
            ffmpegManager.stop(profile.id).catch(() => {});
          }
        }

        // Update last_run and compute next_run
        const nextRun = this.computeNextRun(sched, now);
        db.prepare('UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?').run(
          now.toISOString(), nextRun || null, sched.id
        );
      }
    } catch (e) {
      logger.error('Scheduler tick error', String(e));
    }
  }

  private shouldRun(sched: Schedule, now: Date): boolean {
    if (!sched.enabled) return false;
    const schedDate = new Date(sched.start_date + 'T' + sched.start_time);
    if (now < schedDate) return false;

    // Already ran today (one-shot)
    if (sched.repeat === 'none') {
      return !sched.last_run;
    }

    const lastRun = sched.last_run ? new Date(sched.last_run) : null;
    const todayStr = now.toISOString().slice(0, 10);
    const lastRunStr = lastRun ? lastRun.toISOString().slice(0, 10) : '';
    if (lastRunStr === todayStr) return false;

    const [h, m] = sched.start_time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() < m) return false;

    if (sched.repeat === 'daily') return true;
    if (sched.repeat === 'weekly') {
      const days = (sched.days_of_week || '').split(',').map(Number);
      return days.includes(now.getDay());
    }
    if (sched.repeat === 'monthly') {
      return now.getDate() === (sched.day_of_month || 1);
    }
    return false;
  }

  private computeNextRun(sched: Schedule, from: Date): string | null {
    if (sched.repeat === 'none') return null;
    const next = new Date(from);
    next.setSeconds(0, 0);
    if (sched.repeat === 'daily') next.setDate(next.getDate() + 1);
    else if (sched.repeat === 'weekly') next.setDate(next.getDate() + 7);
    else if (sched.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }
}

export const scheduler = new Scheduler();
