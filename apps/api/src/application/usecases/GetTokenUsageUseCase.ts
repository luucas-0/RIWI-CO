import { AiUsageRepository } from '../../domain/repositories.js';

export class GetTokenUsageUseCase {
  constructor(private readonly aiUsageRepository: AiUsageRepository) {}

  async execute(userId: string) {
    return this.aiUsageRepository.aggregateByUser(userId);
  }
}
