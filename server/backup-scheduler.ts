import cron from 'node-cron';
import { storage } from './storage';

let scheduledTask: cron.ScheduledTask | null = null;

export class BackupScheduler {
  private static instance: BackupScheduler;
  private currentSchedule: string | null = null;

  private constructor() {}

  static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  async initializeScheduler(): Promise<void> {
    try {
      const settings = await storage.getSystemSettings();

      if (settings?.autoBackup) {
        await this.updateSchedule(settings.backupFrequency, settings.backupTime);
        console.log('Backup scheduler initialized');
      } else {
        console.log('Auto backup is disabled');
      }
    } catch (error) {
      console.error('Failed to initialize backup scheduler:', error);
    }
  }

  async updateSchedule(frequency: string, time: string, date?: string): Promise<void> {
    try {
      // Stop existing scheduler
      this.stopScheduler();

      // Parse time (format: "HH:MM")
      const [hours, minutes] = time.split(':').map(Number);

      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time format. Expected HH:MM');
      }

      // Create cron expression based on frequency
      let cronExpression: string;

      switch (frequency) {
        case 'daily':
          cronExpression = `${minutes} ${hours} * * *`;
          break;
        case 'weekly':
          cronExpression = `${minutes} ${hours} * * 0`; // Sunday
          break;
        case 'monthly':
          // Use user-configured date or default to 1st
          const dayOfMonth = date ? parseInt(date) : 1;
          if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
            throw new Error('Invalid date for monthly backup. Expected 1-31');
          }
          cronExpression = `${minutes} ${hours} ${dayOfMonth} * *`;
          break;
        default:
          throw new Error(`Unsupported backup frequency: ${frequency}`);
      }

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Start new scheduler
      scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`Starting automatic backup (${frequency})`);
        await this.performBackup();
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata' // Indian timezone
      });

      this.currentSchedule = cronExpression;
      console.log(`Backup scheduled: ${frequency} at ${time} (${cronExpression})`);

    } catch (error) {
      console.error('Failed to update backup schedule:', error);
      throw error;
    }
  }

  stopScheduler(): void {
    if (scheduledTask) {
      scheduledTask.destroy();
      scheduledTask = null;
      this.currentSchedule = null;
      console.log('Backup scheduler stopped');
    }
  }

  async performBackup(): Promise<void> {
    try {
      // Check if auto backup is still enabled
      const settings = await storage.getSystemSettings();

      if (!settings?.autoBackup) {
        console.log('Auto backup is disabled, skipping scheduled backup');
        return;
      }

      console.log('Creating automatic backup...');
      const backup = await storage.createBackup('auto', 'admin-user-id');
      console.log(`Automatic backup completed: ${backup.backupId}`);
      console.log(`Backup details:`, JSON.stringify(backup, null, 2));

      // Log activity for automatic backup creation
      // Use admin user ID for system-generated activities
      await storage.createActivity({
        userId: 'admin-user-id',
        activityType: 'backup_created',
        title: 'Backup Created',
        description: 'Scheduled Backup Created',
        entityId: backup.backupId,
        entityType: 'backup',
        metadata: JSON.stringify({
          backupId: backup.backupId,
          fileName: backup.filePath ? backup.filePath.split('/').pop() : 'unknown',
          fileSize: backup.fileSize,
          backupType: 'automatic',
        }),
      });

      // Clean up old backups
      await storage.cleanOldBackups();
      console.log('Old backups cleanup completed');

    } catch (error) {
      console.error('Automatic backup failed:', error);
      // Don't throw the error to prevent scheduler from stopping
    }
  }

  async enableAutoBackup(frequency: string, time: string, date?: string): Promise<void> {
    await this.updateSchedule(frequency, time, date);
  }

  async disableAutoBackup(): Promise<void> {
    this.stopScheduler();
    console.log('Auto backup disabled');
  }

  getCurrentSchedule(): string | null {
    return this.currentSchedule;
  }

  isRunning(): boolean {
    return scheduledTask !== null;
  }
}

// Export singleton instance
export const backupScheduler = BackupScheduler.getInstance();