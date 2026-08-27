import { useMemo } from "react"
import { useOutletContext } from "react-router-dom"
import { ReceiptTextIcon } from "@/components/icons"

import { Card, CardContent } from "@/components/ui/card"
import { TABLE_SURFACE } from "@/components/commons/data-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  InstitutionEmptyState,
  InstitutionErrorState,
  InstitutionLoadingSkeleton,
  InstitutionPageHeader,
  InstitutionStatCard,
  InstitutionStatusBadge,
  formatDateTime,
  formatMoney,
} from "@/components/institution/institution-ui.jsx"
import { useInstitutionData } from "@/hooks/use-institution-data.js"

export default function InstitutionBillingPage() {
  const { institution, institutionLoading, institutionError, refetchInstitution } =
    useOutletContext()
  const data = useInstitutionData(institution?.institutionId)

  const invoices = useMemo(
    () =>
      [...data.invoices].sort(
        (a, b) => new Date(b.issuedAt ?? 0) - new Date(a.issuedAt ?? 0)
      ),
    [data.invoices]
  )

  if (institutionLoading || (institution && data.isLoading)) {
    return <InstitutionLoadingSkeleton />
  }
  if (institutionError) {
    return <InstitutionErrorState onRetry={refetchInstitution} />
  }
  if (!institution) {
    return (
      <InstitutionEmptyState
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
      <InstitutionPageHeader
        title="Billing"
        subtitle="Invoices issued to your organization for certification access."
      />

      {data.isError ? (
        <InstitutionErrorState onRetry={data.refetchAll} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <InstitutionStatCard label="Total invoices" value={invoices.length} />
            <InstitutionStatCard
              label="Outstanding"
              value={outstanding.length}
            />
            <InstitutionStatCard label="Paid" value={paid.length} />
          </div>

          {invoices.length === 0 ? (
            <InstitutionEmptyState
              icon={ReceiptTextIcon}
              title="No invoices yet"
              description="Invoices are issued after a partnership request is approved."
            />
          ) : (
            <Card className={TABLE_SURFACE}>
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
                      <TableRow key={invoice.institutionInvoiceId}>
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
                          <InstitutionStatusBadge status={invoice.status} />
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
