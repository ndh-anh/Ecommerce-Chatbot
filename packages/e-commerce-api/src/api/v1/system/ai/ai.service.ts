import {
  Injectable,
  OnModuleInit,
  Inject,
  Logger,
  InternalServerErrorException,
  GatewayTimeoutException,
  ConflictException,
} from '@nestjs/common';
import { CallOptions, Metadata, status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ChatRequest,
  ChatResponse,
  GetChatHistoryRequest,
  GetChatHistoryResponse,
} from '@/buf/generated/ai_assistant/v1/ai_assistant';

interface AiChatServiceClient {
  chat(
    request: ChatRequest,
    metadata: Metadata,
    options: CallOptions,
  ): Observable<ChatResponse>;
  getChatHistory(
    request: GetChatHistoryRequest,
    metadata: Metadata,
    options: CallOptions,
  ): Observable<GetChatHistoryResponse>;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private chatServiceClient!: AiChatServiceClient;

  constructor(
    @Inject('AI_ASSISTANT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.chatServiceClient =
      this.client.getService<AiChatServiceClient>('ChatService');
  }

  /** Read both JSON payloads and plain text from legacy agent checkpoints. */
  parseToolData(data?: string): unknown {
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  async chat(
    message: string,
    sessionId?: string,
    userId?: string,
    confirm?: boolean,
  ) {
    try {
      const response = await firstValueFrom(
        this.chatServiceClient.chat(
          {
            message,
            sessionId: sessionId || '',
            userId: userId || '',
            confirm: confirm,
          },
          new Metadata(),
          { deadline: Date.now() + 90_000 },
        ),
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to process chat: ${error.message}`,
        error.stack,
      );
      if (error.code === status.DEADLINE_EXCEEDED) {
        throw new GatewayTimeoutException(
          'Trợ lý phản hồi quá lâu. Hãy kiểm tra lịch sử trước khi gửi lại yêu cầu đặt hàng.',
        );
      }
      if (error.code === status.RESOURCE_EXHAUSTED) {
        throw new ConflictException(
          'Yêu cầu trước vẫn đang xử lý. Vui lòng chờ và tải lại lịch sử trò chuyện.',
        );
      }
      throw new InternalServerErrorException(
        'Trợ lý hiện chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
      );
    }
  }

  async getChatHistory(sessionId: string, userId: string) {
    try {
      const response = await firstValueFrom(
        this.chatServiceClient.getChatHistory(
          {
            sessionId,
            userId,
          },
          new Metadata(),
          { deadline: Date.now() + 10_000 },
        ),
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to get chat history: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        error.details || 'Lỗi khi lấy lịch sử chat (gRPC)',
      );
    }
  }
}
