export class LivepixWebhookDto {
  userId: string;
  clientId: string;
  event: string;
  resource: {
    id: string;
    reference: string;
    type: string;
  };
}

export class PaymentDetailsDto {
  id: string;
  status: string;
  value: number;
  currency: string;
  payer: {
    id?: string;
    name?: string;
    email?: string;
    username?: string;
  };
  createdAt: string;
  reference?: string;
}
