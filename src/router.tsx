import { Navigate } from "react-router-dom";
import { RedirectWithParams } from "./components/routing/redirect-with-params";
import { RequireAuth } from "./components/auth/require-auth";
import { RequireMember } from "./components/auth/require-member";
import { AppShell } from "./components/layout/app-shell";
import Cases from "./pages/cases";
import CaseDetail from "./pages/cases/detail";
import Home from "./pages/dashboard";
import Analytics from "./pages/dashboard/analytics";
import DecisionCenter from "./pages/decision";
import CreateMemo from "./pages/create-memo";
import FindInvestors from "./pages/find-investors";
import ImportsPage from "./pages/imports";
import DealInbox from "./pages/deal-inbox";
import VoiceCapture from "./pages/inbox/capture";
import Investors from "./pages/investors";
import InvestorDetail from "./pages/investors/detail";
import Login from "./pages/login";
import Matches from "./pages/matches";
import NotFound from "./pages/NotFound";
import WorkspaceAccess from "./pages/workspace";

export const routers = [
  {
    path: "/login",
    name: "login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RequireMember>
          <AppShell />
        </RequireMember>
      </RequireAuth>
    ),
    children: [
      { index: true, name: "home", element: <Home /> },
      { path: "analytics", name: "analytics", element: <Analytics /> },
      { path: "create-memo", name: "create-memo", element: <CreateMemo /> },
      { path: "find-investors", name: "find-investors", element: <FindInvestors /> },
      { path: "inbox", name: "deal-inbox", element: <DealInbox /> },
      { path: "inbox/capture", name: "voice-capture", element: <VoiceCapture /> },
      { path: "cases", name: "cases", element: <Cases /> },
      { path: "deals", name: "deals-redirect", element: <RedirectWithParams to="/cases" /> },
      { path: "import-files", name: "import-files-redirect", element: <RedirectWithParams to="/imports" /> },
      { path: "cases/:id", name: "case-detail", element: <CaseDetail /> },
      { path: "tasks", name: "tasks-outreach", element: <DecisionCenter /> },
      { path: "decision", name: "decision-center-redirect", element: <RedirectWithParams to="/tasks" /> },
      { path: "dashboard", name: "dashboard-redirect", element: <RedirectWithParams to="/analytics" /> },
      { path: "pipeline", name: "pipeline-redirect", element: <RedirectWithParams to="/analytics" /> },
      { path: "investors", name: "investors", element: <Investors /> },
      { path: "investors/:id", name: "investor-detail", element: <InvestorDetail /> },
      { path: "matches", name: "matches", element: <Matches /> },
      { path: "imports", name: "imports", element: <ImportsPage /> },
      { path: "workspace", name: "workspace-access", element: <WorkspaceAccess /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
