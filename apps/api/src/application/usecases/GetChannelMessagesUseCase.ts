import { MessageRepository } from '../../domain/repositories.js';

export class GetChannelMessagesUseCase {
  constructor(private readonly messageRepository: MessageRepository) {}

  async execute(channelId: string, userId: string, cursor?: { rw_created_at: Date; rw_id: string }, limit = 25) {
    void userId;
    return this.messageRepository.listByChannel(channelId, cursor, limit);
  }
}
