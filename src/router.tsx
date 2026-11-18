import { RequireAuth } from "./components/auth/require-auth";
import { RequireMember } from "./components/auth/require-member";
import { AppShell } from "./components/layout/app-shell";
import Cases from "./pages/cases";
import CaseDetail from "./pages/cases/detail";
import Dashboard from "./pages/dashboard";
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
      { index: true, name: "dashboard", element: <Dashboard /> },
      { path: "inbox", name: "deal-inbox", element: <DealInbox /> },
      { path: "inbox/capture", name: "voice-capture", element: <VoiceCapture /> },
      { path: "cases", name: "cases", element: <Cases /> },
      { path: "cases/:id", name: "case-detail", element: <CaseDetail /> },
      { path: "investors", name: "investors", element: <Investors /> },
      { path: "investors/:id", name: "investor-detail", element: <InvestorDetail /> },
      { path: "matches", name: "matches", element: <Matches /> },
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
