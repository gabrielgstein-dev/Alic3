import { Interaction } from 'discord.js';

export const catchMemberNick = async (
  interaction: Interaction,
  nick: string,
) => {
  let member;
  if (/^\d+$/.test(nick)) {
    member = await interaction.guild.members.fetch(nick);
  } else {
    const [username, discriminator] = nick.split('#');
    let members;
    if (discriminator) {
      members = await interaction.guild.members.fetch({
        query: username,
        limit: 10,
      });
      member = members.find(
        (m) =>
          m.user.username === username &&
          m.user.discriminator === discriminator,
      );
    } else {
      members = await interaction.guild.members.fetch({
        query: username,
        limit: 10,
      });

      return member;
    }
  }
};
