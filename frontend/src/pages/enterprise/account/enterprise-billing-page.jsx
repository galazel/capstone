import { useMemo } from "react"
import { useOutletContext } from "react-router-dom"
import { ReceiptTextIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatCard,
  EnterpriseStatusBadge,
  formatDateTime,
  formatMoney,
} from "@/components/enterprise/enterprise-ui.jsx"
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"

export default function EnterpriseBillingPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)

  const invoices = useMemo(
    () =>
      [...data.invoices].sort(
        (a, b) => new Date(b.issuedAt ?? 0) - new Date(a.issuedAt ?? 0)
      ),
    [data.invoices]
  )

  if (enterpriseLoading || (enterprise && data.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Invoices appear here once your organization is registered."
      />
    )
  }

  const outstanding = invoices.filter(
    (invoice) => invoice.status === "issued" || invoice.status === "overdue"
  )
  const paid = invoices.filter((invoice) => invoice.status === "paid")

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Billing"
        subtitle="Invoices issued to your organization for certification access."
      />

      {data.isError ? (
        <EnterpriseErrorState onRetry={data.refetchAll} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <EnterpriseStatCard label="Total invoices" value={invoices.length} />
            <EnterpriseStatCard
              label="Outstanding"
              value={outstanding.length}
            />
            <EnterpriseStatCard label="Paid" value={paid.length} />
          </div>

          {invoices.length === 0 ? (
            <EnterpriseEmptyState
              icon={ReceiptTextIcon}
              title="No invoices yet"
              description="Invoices are issued after a partnership request is approved."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Billed to</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.enterpriseInvoiceId}>
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{invoice.billToName}</div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.billToEmail}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(invoice.issuedAt)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(invoice.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <EnterpriseStatusBadge status={invoice.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
