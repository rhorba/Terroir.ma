import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemSetting1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE common.system_setting (
        setting_group  VARCHAR(50)   NOT NULL,
        setting_key    VARCHAR(100)  NOT NULL,
        setting_value  TEXT          NOT NULL,
        updated_by     UUID,
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        PRIMARY KEY (setting_group, setting_key)
      );
    `);

    await queryRunner.query(`
      INSERT INTO common.system_setting (setting_group, setting_key, setting_value, updated_at) VALUES
        ('campaign',      'current_campaign_year',  '2025-2026',           NOW()),
        ('campaign',      'campaign_start_month',   '10',                  NOW()),
        ('campaign',      'campaign_end_month',     '9',                   NOW()),
        ('certification', 'default_validity_days',  '365',                 NOW()),
        ('certification', 'max_renewal_grace_days', '90',                  NOW()),
        ('platform',      'maintenance_mode',       'false',               NOW()),
        ('platform',      'support_email',          'support@terroir.ma',  NOW());
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS common.system_setting;`);
  }
}
