import { TextChannel } from 'discord.js';

export const clearChannel = async (channel: TextChannel) => {
  let fetched;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
      await channel.bulkDelete(fetched, true);
    }
  } while (fetched.size >= 2);
};
