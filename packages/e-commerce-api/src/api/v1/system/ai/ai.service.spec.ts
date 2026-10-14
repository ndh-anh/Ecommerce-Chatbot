import { AiService } from './ai.service';
import { ConflictException, GatewayTimeoutException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Metadata, status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';

describe('AiService', () => {
  const chat = jest.fn();
  const getChatHistory = jest.fn();
  let service: AiService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiService({
      getService: () => ({ chat, getChatHistory }),
    } as unknown as ClientGrpc);
    service.onModuleInit();
  });

  it.each([
    ['', null],
    ['null', null],
    ['{"order_id":"o1"}', { order_id: 'o1' }],
    ['Đặt hàng thành công', 'Đặt hàng thành công'],
    ['"Đặt hàng thành công"', 'Đặt hàng thành công'],
  ])('reads current and legacy data %s', (input, expected) => {
    expect(service.parseToolData(input)).toEqual(expected);
  });

  it('sets a deadline and preserves explicit rejection', async () => {
    chat.mockReturnValue(of({ message: 'Đã hủy yêu cầu' }));
    const before = Date.now();
    await service.chat('Từ chối', 's1', 'u1', false);
    expect(chat).toHaveBeenCalledWith(
      { message: 'Từ chối', sessionId: 's1', userId: 'u1', confirm: false },
      expect.any(Metadata),
      { deadline: expect.any(Number) },
    );
    expect(chat.mock.calls[0][2].deadline).toBeGreaterThanOrEqual(
      before + 90_000,
    );
  });

  it('returns a timeout response instead of waiting forever', async () => {
    chat.mockReturnValue(
      throwError(() => ({
        code: status.DEADLINE_EXCEEDED,
        message: 'deadline',
      })),
    );
    await expect(service.chat('mua hàng')).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it('bounds history requests', async () => {
    getChatHistory.mockReturnValue(of({ messages: [] }));
    await service.getChatHistory('s1', 'u1');
    expect(getChatHistory).toHaveBeenCalledWith(
      { sessionId: 's1', userId: 'u1' },
      expect.any(Metadata),
      { deadline: expect.any(Number) },
    );
  });

  it('reports a busy session without starting another turn', async () => {
    chat.mockReturnValue(
      throwError(() => ({ code: status.RESOURCE_EXHAUSTED, message: 'busy' })),
    );
    await expect(service.chat('mua lại')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
