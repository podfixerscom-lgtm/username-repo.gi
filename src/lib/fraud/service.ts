import { getPrisma } from "@/lib/prisma";
import { HistoryOnlyFraudAdapter, type FraudCheckAdapter } from "./adapter";

const defaultAdapter: FraudCheckAdapter = new HistoryOnlyFraudAdapter();

export async function runCustomerFraudCheck(
  customerId: string,
  checkedById: string,
  adapter: FraudCheckAdapter = defaultAdapter,
) {
  const customer = await getPrisma().customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, total: true, createdAt: true },
      },
    },
  });
  if (!customer) throw new Error("Customer was not found.");
  if (customer.orders.length === 0) throw new Error("Customer has no orders to check.");

  const result = await adapter.checkCustomer({
    customerPhone: customer.phone,
    orders: customer.orders.map((order) => ({
      status: order.status,
      total: order.total.toFixed(2),
      createdAt: order.createdAt,
    })),
  });

  return getPrisma().fraudCheck.create({
    data: {
      orderId: customer.orders[0].id,
      checkedById,
      provider: adapter.provider,
      riskLevel: result.riskLevel,
      summary: result.summary,
      externalRef: result.externalRef,
    },
  });
}
