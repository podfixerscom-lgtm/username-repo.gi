import type { FraudRiskLevel } from "@/generated/prisma/client";

export type FraudHistoryOrder = {
  status: string;
  total: string;
  createdAt: Date;
};

export type FraudHistoryInput = {
  customerPhone: string;
  orders: readonly FraudHistoryOrder[];
};

export type FraudCheckResult = {
  riskLevel: FraudRiskLevel;
  summary: string;
  externalRef?: string;
};

export interface FraudCheckAdapter {
  readonly provider: string;
  checkCustomer(input: FraudHistoryInput): Promise<FraudCheckResult>;
}

export class HistoryOnlyFraudAdapter implements FraudCheckAdapter {
  readonly provider = "local-history";

  async checkCustomer({ orders }: FraudHistoryInput): Promise<FraudCheckResult> {
    const returned = orders.filter((order) => order.status === "RETURNED").length;
    const cancelled = orders.filter((order) => order.status === "CANCELLED").length;
    const delivered = orders.filter((order) => order.status === "DELIVERED").length;
    return {
      riskLevel: "UNKNOWN",
      summary: `History only: ${orders.length} orders, ${delivered} delivered, ${returned} returned, ${cancelled} cancelled. No external fraud provider is configured; this is not a fraud verdict.`,
    };
  }
}
