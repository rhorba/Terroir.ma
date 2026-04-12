import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import { Member } from '../entities/member.entity';
import { Farm } from '../entities/farm.entity';
import { CreateCooperativeDto } from '../dto/create-cooperative.dto';
import { UpdateCooperativeDto } from '../dto/update-cooperative.dto';
import { AddMemberDto } from '../dto/add-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { MapFarmDto } from '../dto/map-farm.dto';
import { CooperativeProducer } from '../events/cooperative.producer';

/**
 * Cooperative service — business logic for cooperative management.
 * Publishes Kafka events on all state changes.
 */
@Injectable()
export class CooperativeService {
  constructor(
    @InjectRepository(Cooperative)
    private readonly cooperativeRepo: Repository<Cooperative>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    private readonly producer: CooperativeProducer,
  ) {}

  /**
   * Register a new cooperative.
   * @throws ConflictException if ICE already exists
   */
  async register(dto: CreateCooperativeDto, createdBy: string): Promise<Cooperative> {
    const existing = await this.cooperativeRepo.findOne({ where: { ice: dto.ice } });
    if (existing) {
      throw new ConflictException({
        code: 'COOPERATIVE_ALREADY_EXISTS',
        message: 'A cooperative with this ICE already exists',
      });
    }

    const cooperative = this.cooperativeRepo.create({
      ...dto,
      nameAr: dto.nameAr ?? null,
      ifNumber: dto.ifNumber ?? null,
      rcNumber: dto.rcNumber ?? null,
      createdBy,
      status: 'pending',
    });
    const saved = await this.cooperativeRepo.save(cooperative);

    await this.producer.publishRegistrationSubmitted(saved, createdBy);

    return saved;
  }

  /**
   * Find a cooperative by ID.
   * @throws NotFoundException if not found
   */
  async findById(id: string): Promise<Cooperative> {
    const cooperative = await this.cooperativeRepo.findOne({
      where: { id },
      relations: ['members', 'farms'],
    });
    if (!cooperative) {
      throw new NotFoundException({
        code: 'COOPERATIVE_NOT_FOUND',
        message: `Cooperative ${id} not found`,
      });
    }
    return cooperative;
  }

  /**
   * Verify a cooperative (super-admin only).
   * Sets status to 'active', records who verified and when.
   * Publishes cooperative.registration.verified Kafka event.
   * @throws NotFoundException if not found
   * @throws BadRequestException if already active
   */
  async verify(id: string, verifiedBy: string, correlationId: string): Promise<Cooperative> {
    const cooperative = await this.findById(id);

    if (cooperative.status === 'active') {
      throw new BadRequestException({
        code: 'COOPERATIVE_ALREADY_VERIFIED',
        message: 'Cooperative is already verified',
      });
    }

    const verifiedAt = new Date();
    await this.cooperativeRepo.update({ id }, { status: 'active', verifiedAt, verifiedBy });

    const updated = await this.findById(id);
    await this.producer.publishRegistrationVerified(updated, verifiedBy, correlationId);
    return updated;
  }

  /**
   * Update cooperative details.
   * @throws NotFoundException if not found
   */
  async update(id: string, dto: UpdateCooperativeDto, _updatedBy: string): Promise<Cooperative> {
    const cooperative = await this.findById(id);
    Object.assign(cooperative, dto);
    return this.cooperativeRepo.save(cooperative);
  }

  /**
   * Add a member to a cooperative.
   * @throws ConflictException if member with same CIN already exists
   */
  async addMember(cooperativeId: string, dto: AddMemberDto, createdBy: string): Promise<void> {
    await this.findById(cooperativeId);
    const existing = await this.memberRepo.findOne({ where: { cin: dto.cin } });
    if (existing) {
      throw new ConflictException({
        code: 'MEMBER_DUPLICATE_CIN',
        message: 'A member with this CIN already exists',
      });
    }
    const member = this.memberRepo.create({
      ...dto,
      fullNameAr: dto.fullNameAr ?? null,
      email: dto.email ?? null,
      cooperativeId,
      createdBy,
    });
    await this.memberRepo.save(member);
  }

  /**
   * Return a paginated list of active members for a cooperative.
   * Scoped to the given cooperativeId — never returns members from other cooperatives.
   */
  async getMembers(
    cooperativeId: string,
    page: number,
    limit: number,
  ): Promise<[Member[], number]> {
    return this.memberRepo.findAndCount({
      where: { cooperativeId, isActive: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  /**
   * Update a member's mutable profile fields (phone, email).
   * Enforces that requesterId === memberId — members may only update their own profile.
   * @throws BadRequestException if requesterId !== memberId
   * @throws NotFoundException if member not found within the cooperative
   */
  async updateMember(
    cooperativeId: string,
    memberId: string,
    dto: UpdateMemberDto,
    requesterId: string,
  ): Promise<Member> {
    if (requesterId !== memberId) {
      throw new BadRequestException({
        code: 'MEMBER_SELF_UPDATE_ONLY',
        message: 'Members may only update their own profile',
      });
    }
    const member = await this.memberRepo.findOne({
      where: { id: memberId, cooperativeId },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: `Member ${memberId} not found in cooperative ${cooperativeId}`,
      });
    }
    if (dto.phone !== undefined) member.phone = dto.phone;
    if (dto.email !== undefined) member.email = dto.email ?? null;
    return this.memberRepo.save(member);
  }

  /**
   * Map a farm to a cooperative with GPS coordinates.
   */
  async mapFarm(cooperativeId: string, dto: MapFarmDto, createdBy: string): Promise<void> {
    await this.findById(cooperativeId);
    const location =
      dto.latitude != null && dto.longitude != null
        ? `POINT(${dto.longitude} ${dto.latitude})`
        : null;
    const farm = this.farmRepo.create({
      ...dto,
      commune: dto.commune ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      cooperativeId,
      location,
      createdBy,
    });
    const saved = await this.farmRepo.save(farm);
    await this.producer.publishFarmMapped(saved, createdBy);
  }
}
