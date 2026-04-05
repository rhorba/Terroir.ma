import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CooperativeController } from './controllers/cooperative.controller';
import { CooperativeService } from './services/cooperative.service';
import { Cooperative } from './entities/cooperative.entity';
import { Member } from './entities/member.entity';
import { Farm } from './entities/farm.entity';
import { CooperativeProducer } from './events/cooperative.producer';
import { CooperativeListener } from './listeners/cooperative.listener';

/**
 * Cooperative module — manages cooperative registration, members, and farm mapping.
 * PostgreSQL schema: cooperative
 * Publishes events: cooperative.registration.submitted, cooperative.farm.mapped
 * Consumes events: cooperative.registration.verified
 */
@Module({
  imports: [TypeOrmModule.forFeature([Cooperative, Member, Farm])],
  controllers: [CooperativeController, CooperativeListener],
  providers: [CooperativeService, CooperativeProducer],
  exports: [],
})
export class CooperativeModule {}
