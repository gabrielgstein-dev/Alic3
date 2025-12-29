export class CreateDonationDto {
  discordId: string;
  amount: number;
  discordUsername?: string;
}

export class DonationResponseDto {
  paymentUrl: string;
  paymentId: string;
  qrCode?: string;
}
