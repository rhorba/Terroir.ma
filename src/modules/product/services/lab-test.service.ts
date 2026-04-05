import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';
import { ProductType } from '../entities/product-type.entity';
import { ProductionBatch } from '../entities/production-batch.entity';
import { SubmitLabTestDto, RecordLabTestResultDto } from '../dto/submit-lab-test.dto';
import { ProductProducer } from '../events/product.producer';

interface LabTestParameter {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  type?: string;
  values?: string[];
}

interface ValidationResult {
  passed: boolean;
  failedParameters: string[];
}

/**
 * Lab test service — manages lab test submission and result recording.
 * Validates test values against product type parameters.
 */
@Injectable()
export class LabTestService {
  private readonly logger = new Logger(LabTestService.name);

  constructor(
    @InjectRepository(LabTest)
    private readonly labTestRepo: Repository<LabTest>,
    @InjectRepository(LabTestResult)
    private readonly labTestResultRepo: Repository<LabTestResult>,
    @InjectRepository(ProductType)
    private readonly productTypeRepo: Repository<ProductType>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly producer: ProductProducer,
  ) {}

  /**
   * Submit a new lab test for a production batch.
   */
  async submitLabTest(
    dto: SubmitLabTestDto,
    cooperativeId: string,
    submittedBy: string,
  ): Promise<LabTest> {
    const batch = await this.batchRepo.findOne({ where: { id: dto.batchId } });
    if (!batch) {
      throw new NotFoundException({
        code: 'BATCH_NOT_FOUND',
        message: `Batch ${dto.batchId} not found`,
      });
    }

    const labTest = this.labTestRepo.create({
      batchId: dto.batchId,
      cooperativeId,
      productTypeCode: batch.productTypeCode,
      laboratoryId: dto.laboratoryId ?? null,
      submittedAt: new Date(),
      submittedBy,
      expectedResultDate: dto.expectedResultDate ?? null,
      status: 'submitted',
    });

    const saved = await this.labTestRepo.save(labTest);

    // Update batch status to lab_testing
    await this.batchRepo.update({ id: dto.batchId }, { status: 'lab_testing' });

    await this.producer.publishLabTestSubmitted(saved, submittedBy, dto.expectedResultDate ?? null);

    return saved;
  }

  /**
   * Record the result of a completed lab test.
   * Validates test values against product type parameters.
   */
  async recordResult(
    dto: RecordLabTestResultDto,
    technicianId: string,
    correlationId: string,
  ): Promise<LabTestResult> {
    const labTest = await this.labTestRepo.findOne({ where: { id: dto.labTestId } });
    if (!labTest) {
      throw new NotFoundException({
        code: 'LAB_TEST_NOT_FOUND',
        message: `Lab test ${dto.labTestId} not found`,
      });
    }

    const { passed, failedParameters } = await this.validateLabTestParameters(
      labTest.productTypeCode,
      dto.testValues,
    );

    const result = this.labTestResultRepo.create({
      labTestId: labTest.id,
      batchId: labTest.batchId,
      productTypeCode: labTest.productTypeCode,
      passed,
      testValues: dto.testValues,
      failedParameters,
      technicianName: dto.technicianName ?? 'Unknown',
      technicianId,
      laboratoryName: dto.laboratoryName ?? null,
      completedAt: new Date(),
    });

    const savedResult = await this.labTestResultRepo.save(result);

    // Update lab test and batch status
    await this.labTestRepo.update({ id: labTest.id }, { status: 'completed' });
    await this.batchRepo.update(
      { id: labTest.batchId },
      { status: passed ? 'lab_passed' : 'lab_failed' },
    );

    this.logger.log(
      { labTestId: labTest.id, passed, failedParameters },
      'Lab test result recorded',
    );

    await this.producer.publishLabTestCompleted(labTest, savedResult, correlationId);

    return savedResult;
  }

  /**
   * Validate test values against the expected parameters for the product type.
   * Returns a validation result with pass/fail and list of failed parameters.
   */
  async validateLabTestParameters(
    productTypeCode: string,
    testValues: Record<string, number | string>,
  ): Promise<ValidationResult> {
    const productType = await this.productTypeRepo.findOne({
      where: { code: productTypeCode },
    });

    if (!productType) {
      // If product type not found, allow all values (no parameters to validate against)
      this.logger.warn({ productTypeCode }, 'Product type not found, skipping parameter validation');
      return { passed: true, failedParameters: [] };
    }

    const failedParameters: string[] = [];

    for (const param of productType.labTestParameters as LabTestParameter[]) {
      const value = testValues[param.name];

      if (value === undefined || value === null) {
        // Required parameter missing
        failedParameters.push(`${param.name}: missing`);
        continue;
      }

      if (param.type === 'enum' && param.values) {
        // Enum validation
        if (!param.values.includes(String(value))) {
          failedParameters.push(
            `${param.name}: expected one of [${param.values.join(', ')}], got ${value}`,
          );
        }
        continue;
      }

      // Numeric range validation
      const numValue = Number(value);
      if (isNaN(numValue)) {
        failedParameters.push(`${param.name}: expected numeric value, got ${value}`);
        continue;
      }

      if (param.minValue !== undefined && numValue < param.minValue) {
        failedParameters.push(
          `${param.name}: ${numValue} ${param.unit} < min ${param.minValue} ${param.unit}`,
        );
      }

      if (param.maxValue !== undefined && numValue > param.maxValue) {
        failedParameters.push(
          `${param.name}: ${numValue} ${param.unit} > max ${param.maxValue} ${param.unit}`,
        );
      }
    }

    return { passed: failedParameters.length === 0, failedParameters };
  }

  async findById(id: string): Promise<LabTest> {
    const labTest = await this.labTestRepo.findOne({ where: { id } });
    if (!labTest) {
      throw new NotFoundException({
        code: 'LAB_TEST_NOT_FOUND',
        message: `Lab test ${id} not found`,
      });
    }
    return labTest;
  }

  async findResultByLabTestId(labTestId: string): Promise<LabTestResult | null> {
    return this.labTestResultRepo.findOne({ where: { labTestId } });
  }
}
