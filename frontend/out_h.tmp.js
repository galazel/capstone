import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, UsersRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnterpriseEmptyState, EnterpriseErrorState, EnterpriseLoadingSkeleton, EnterprisePageHeader } from "@/components/enterprise/enterprise-ui.jsx";
import { getEnterpriseGroups } from "@/services/enterpriseService.js";
export default function EnterpriseMemberDashboardPage() {
  const groupsQuery = useQuery({ queryKey: ["my-enterprise-groups"], queryFn: getEnterpriseGroups, retry: 1 });
  if (groupsQuery.isLoading) return /* @__PURE__ */ React.createElement(EnterpriseLoadingSkeleton, null);
  if (groupsQuery.isError) return /* @__PURE__ */ React.createElement(EnterpriseErrorState, { title: "Unable to load your groups", onRetry: groupsQuery.refetch });
  const groups = (groupsQuery.data ?? []).filter((group) => group.status === "active");
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React.createElement(EnterprisePageHeader, { title: "My Groups", subtitle: "Choose a group to view its curriculum, instructional content, and learners." }), groups.length === 0 ? /* @__PURE__ */ React.createElement(EnterpriseEmptyState, { icon: UsersRoundIcon, title: "No groups assigned", description: "Ask your Institution Administrator to assign you as a group authority." }) : /* @__PURE__ */ React.createElement("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3" }, groups.map((group) => /* @__PURE__ */ React.createElement(Card, { key: group.enterpriseGroupId, className: "flex flex-col" }, /* @__PURE__ */ React.createElement(CardHeader, null, /* @__PURE__ */ React.createElement(UsersRoundIcon, { className: "mb-2 size-5 text-primary" }), /* @__PURE__ */ React.createElement(CardTitle, null, group.groupName), /* @__PURE__ */ React.createElement(CardDescription, null, group.groupDescription || "Assigned learning group")), /* @__PURE__ */ React.createElement(CardContent, { className: "mt-auto" }, /* @__PURE__ */ React.createElement(Button, { asChild: true, className: "w-full" }, /* @__PURE__ */ React.createElement(Link, { to: `/enterprise/groups/${group.enterpriseGroupId}` }, /* @__PURE__ */ React.createElement(BookOpenIcon, { className: "size-4" }), "Open workspace")))))));
}
