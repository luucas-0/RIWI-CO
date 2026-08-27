import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'development-refresh-secret',
  postgresUrl: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/bd_lucas_mortigo_clan',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
