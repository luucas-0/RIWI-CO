import { AiProvider, ChannelRepository, MessageRepository } from '../../domain/repositories.js';

export class GetRagContextUseCase {
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly messageRepository: MessageRepository,
    private readonly aiProvider: AiProvider,
  ) {}

  async execute(userId: string, query: string) {
    const channels = await this.channelRepository.listForUser(userId);
    const channelIds = channels.map((channel) => channel.rw_id);

    const context = await this.messageRepository.search(channelIds[0] ?? '', query, undefined, 8).catch(() => []);

    const result = await this.aiProvider.answerWithRag({
      userId,
      channelIds,
      question: query,
      context: context.map((message) => ({
        rw_id: message.rw_id,
        rw_content: message.rw_content,
        rw_channel_id: message.rw_channel_id,
        rw_created_at: message.rw_created_at,
      })),
    });

    return result;
  }
}
