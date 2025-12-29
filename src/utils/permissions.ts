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

export function hasStaff(interaction: Interaction, staffRoleId?: string, adminRoleId?: string) {
  if (!interaction.member || !interaction.guild) return false;

  const member = interaction.guild.members.cache.get(
    interaction.member.user.id,
  );
  if (!member) return false;

  if (!staffRoleId && !adminRoleId) {
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
  }

  const hasStaffRole = staffRoleId ? member.roles.cache.has(staffRoleId) : false;
  const hasAdminRole = adminRoleId ? member.roles.cache.has(adminRoleId) : false;

  return hasStaffRole || hasAdminRole || member.permissions.has(PermissionsBitField.Flags.Administrator);
}
