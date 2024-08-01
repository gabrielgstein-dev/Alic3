import { Interaction, PermissionsBitField } from 'discord.js';

export function getPermissionOverwrites(
  guildId: string,
  userId: string,
  clientId: string,
  supportRoleIds: string[],
) {
  const permissionOverwrites = [
    {
      id: guildId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    },
    {
      id: clientId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages,
      ],
    },
  ];

  supportRoleIds.forEach((roleId) => {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    });
  });

  return permissionOverwrites;
}

export function hasStaff(interaction: Interaction) {
  if (!interaction.member || !interaction.guild) return false;

  const member = interaction.guild.members.cache.get(
    interaction.member.user.id,
  );
  if (!member) return false;

  const hasStaffRole = member.roles.cache.has(this.staffRoleId);
  const hasAdminRole = member.roles.cache.has(this.adminRoleId);

  return hasStaffRole || hasAdminRole;
}
