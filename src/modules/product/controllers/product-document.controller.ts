import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ProductDocumentService } from '../services/product-document.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ProductDocument } from '../entities/product-document.entity';

/**
 * Product document controller — upload and retrieve product supporting documents.
 * US-017
 */
@ApiTags('product-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductDocumentController {
  constructor(private readonly productDocumentService: ProductDocumentService) {}

  /**
   * US-017: Upload a supporting document for a product registration.
   * Max file size 10 MB enforced by Multer limits.
   */
  @Post(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  @ApiOperation({ summary: 'US-017: Upload supporting document for product registration' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async upload(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProductDocument> {
    return this.productDocumentService.upload(productId, file, user.sub);
  }

  /** US-017: List all supporting documents for a product. */
  @Get(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-017: List supporting documents for a product' })
  async findAll(@Param('id') productId: string): Promise<ProductDocument[]> {
    return this.productDocumentService.findByProduct(productId);
  }

  /** US-017: Download a supporting document (NestJS proxy stream). */
  @Get(':id/documents/:docId/download')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-017: Download supporting document' })
  async download(
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType } = await this.productDocumentService.download(docId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream);
  }
}
