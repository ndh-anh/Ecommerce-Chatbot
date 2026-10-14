import { ClsService } from '@/common/services/cls/cls.service';

import { AiService } from './ai.service';
import { BaseAiControllerInterface } from '@generated-controller/system/ai/base-ai.controller.interface';
import {
  PostAiChat200Response,
  PostAiChatBody,
  GetAiChatHistory200Response,
} from '@e-commerce/api-validation/types/system';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiController implements BaseAiControllerInterface {
  constructor(
    private readonly aiService: AiService,
    private readonly clsService: ClsService,
  ) {}

  async postAiChat(
    requestBody: PostAiChatBody,
  ): Promise<PostAiChat200Response> {
    const userId = this.clsService.userId;
    const grpcResponse = await this.aiService.chat(
      requestBody.message,
      requestBody.sessionId || userId,
      userId,
      requestBody.confirm,
    );

    return {
      message: grpcResponse.message,
      data: this.aiService.parseToolData(grpcResponse.data),
      sessionId: grpcResponse.sessionId,
      type: grpcResponse.type,
    };
  }

  async getAiChatHistory(): Promise<GetAiChatHistory200Response> {
    const userId = this.clsService.userId;
    const sessionId = userId || 'default_session';

    const grpcResponse = await this.aiService.getChatHistory(
      sessionId,
      userId ?? '',
    );

    return {
      messages: grpcResponse.messages
        ? grpcResponse.messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            data: this.aiService.parseToolData(m.data),
          }))
        : [],
    };
  }
}
