// src/onboarding/steps.js
// Tour content + context resolution. Steps carry a route (or null to stay put /
// show a centered modal) and a CSS target selector (or null for centered). Any
// step whose route needs an id we don't have falls back to a centered modal so
// the tour still works for fresh tenants with no projects/SKUs yet.
import { fetchClients, fetchProjects, fetchSkus } from '../lib/api.js';

export async function resolveTourCtx({ isAdmin, profile }) {
  let clientId = profile?.client_id || null;
  try {
    if (isAdmin && !clientId) clientId = (await fetchClients())[0]?.id || null;
    const projects = clientId ? await fetchProjects(clientId) : [];
    const projectId = projects[0]?.id || null;
    const skuId = projectId ? (await fetchSkus(projectId))[0]?.id || null : null;
    return { clientId, projectId, skuId };
  } catch {
    return { clientId, projectId: null, skuId: null };
  }
}

const projectRoute = (ctx) => (ctx.projectId ? `/project/${ctx.projectId}` : null);
const skuRoute = (ctx) => (ctx.skuId ? `/sku/${ctx.skuId}` : null);

function adminSteps(ctx) {
  return [
    { id: 'welcome', route: '/', target: null,
      title: 'Welcome to the Artwork Tracker',
      body: "Every SKU, stage and file in your packaging pipeline lives here — live, nothing buried in email. Here's a quick lap." },
    { id: 'projects', route: '/', target: '[data-tour="projects"]',
      title: 'Projects',
      body: 'Each card is one batch of SKUs for a client. Open a card to see its production line.' },
    { id: 'activity', route: '/', target: '[data-tour="activity"]',
      title: 'Recent activity',
      body: 'Stage ticks, comments and uploads across the tenant, newest first. Click any row to jump to that SKU.' },
    { id: 'sku-row', route: projectRoute(ctx), target: '.sku-row',
      title: 'SKU rows',
      body: 'One row per SKU — codes, compliance badges and live progress at a glance.' },
    { id: 'rail', route: projectRoute(ctx), target: '.rail',
      title: 'The stage rail',
      body: 'Mint dots are done, the pulsing dot is up next. Tick stages right from here — no need to open the SKU.' },
    { id: 'pipeline', route: skuRoute(ctx), target: '[data-tour="pipeline"]',
      title: 'The full pipeline',
      body: "Every stage with dates and approvers. The highlighted gate is the client's sign-off." },
    { id: 'admin-tools', route: skuRoute(ctx), target: '[data-tour="sku-admin-tools"]',
      title: 'Compliance setup',
      body: 'Set the power type and market, then load the matching checklist for this SKU.' },
    { id: 'files', route: skuRoute(ctx), target: '[data-tour="files"]',
      title: 'Briefs, drafts & links',
      body: 'Paste WhatsApp briefs, save links or upload files — everything lands in OneDrive and never expires.' },
    { id: 'comments', route: skuRoute(ctx), target: '[data-tour="comments"]',
      title: 'Comments',
      body: 'Discuss drafts with the client right next to the work itself.' },
    { id: 'settings', route: '/settings', target: '[data-tour="onedrive"]',
      title: 'OneDrive',
      body: "If uploads ever fail, reconnect here in one click. That's the tour — replay it anytime from the header." },
  ];
}

function clientSteps(ctx) {
  return [
    { id: 'welcome', route: '/', target: null,
      title: 'Welcome',
      body: "Track every SKU's artwork from brief to production — live status, no email digging. A quick look around:" },
    { id: 'projects', route: '/', target: '[data-tour="projects"]',
      title: 'Your projects',
      body: 'Each card is one batch of SKUs. Open one to see its production line.' },
    { id: 'sku-row', route: projectRoute(ctx), target: '.sku-row',
      title: 'SKUs at a glance',
      body: 'Codes, badges and progress for every SKU. Click a row for the full detail.' },
    { id: 'rail', route: projectRoute(ctx), target: '.rail',
      title: 'Reading the dots',
      body: "Mint dots are finished stages; the pulsing dot is what's happening right now." },
    { id: 'files', route: skuRoute(ctx), target: '[data-tour="files"]',
      title: 'Files',
      body: 'Every brief, draft and final file in one place — these links never expire.' },
    { id: 'comments', route: skuRoute(ctx), target: '[data-tour="comments"]',
      title: 'Comments',
      body: 'Spotted something on a draft? Leave a comment right here — we see it instantly.' },
    { id: 'approve', route: skuRoute(ctx), target: '[data-tour="request-changes"]',
      title: 'Approve or request changes',
      body: "When artwork is ready, tick the highlighted Final Approved for Print gate. Not happy? Request changes and tell us what's off." },
    { id: 'restart', route: null, target: null,
      title: "That's it",
      body: 'Replay this walkthrough anytime with the Tour button in the header.' },
  ];
}

export function getSteps(isAdmin, ctx) {
  return isAdmin ? adminSteps(ctx) : clientSteps(ctx);
}
