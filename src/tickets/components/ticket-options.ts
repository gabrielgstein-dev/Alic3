import { StringSelectMenuOptionBuilder } from 'discord.js';

export function getSelectMenuOptions() {
  return [
    new StringSelectMenuOptionBuilder()
      .setLabel('Suporte técnico')
      .setDescription('Problemas técnicos ou bugs')
      .setValue('support'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Denúncias')
      .setDescription('Denunciar um jogador')
      .setValue('report'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Dúvidas')
      .setDescription('Perguntas gerais')
      .setValue('questions'),
  ];
}
