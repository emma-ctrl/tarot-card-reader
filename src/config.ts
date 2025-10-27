import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  elevenlabsKey: string;
  cerebrasKey: string;
  openaiKey: string;
  supervisorEnabled: boolean;
  demoMode: boolean;
  debug: boolean;
}

export function loadConfig(): AppConfig {
  const args = process.argv.slice(2);
  const demoMode = args.includes('--demo') || process.env.DEMO_MODE === 'true';
  const debug = args.includes('--debug') || process.env.LOG_LEVEL === 'debug';

  return {
    elevenlabsKey: process.env.ELEVENLABS_API_KEY || '',
    cerebrasKey: process.env.CEREBRAS_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    supervisorEnabled: process.env.SUPERVISOR_ENABLED !== 'false',
    demoMode,
    debug
  };
}
