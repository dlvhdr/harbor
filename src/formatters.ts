import os from "os";
import { Icon } from "@raycast/api";
import { Connection, Process } from "./procs";

const LABEL_MAX_CHARS = 35;

export const formatConnection = (connection: Connection): string => {
  let local, remote;
  if (connection.localAddress != null) {
    local = `${connection.localAddress}:${connection.localPort}`;
  }
  if (connection.remoteAddress != null) {
    remote = `${connection.remoteAddress}:${connection.remotePort}`;
  }
  if (local && remote) {
    return `${local} → ${remote}`;
  }

  return remote ?? local ?? "";
};

export const formatTitle = (procs: Process[], ignoreProcsByArgs: string[]): string => {
  const nodeProcs = procs.filter((p) => {
    return p.cmd === "node" && p.args != null && !ignoreProcsByArgs.includes(p.args);
  });
  return nodeProcs
    .map((p) => p.connections)
    .flat()
    .filter((conn) => conn.remoteAddress == null && conn.remotePort == null)
    .map((conn) => conn.localPort)
    .filter((port) => port !== "443" && port !== "80")
    .join(" · ")
    .trim();
};

export const getCmdDisplayInfo = (proc: Process): { label: string; icon?: Icon } => {
  let formattedPorts: string | undefined = undefined;

  const args = proc.args ?? "";
  if (proc.connections.length > 0) {
    const ports = new Set(proc.connections.map((conn) => conn.localPort));
    formattedPorts = [...ports.values()][0];
    if (ports.size > 1) {
      formattedPorts += ` (${ports.size - 1} more)`;
    }
  }

  const icon = getIconForCmdArgs(args);

  const formattedArgs = truncate(normalizePath(args));

  const label = [formattedPorts, formattedArgs].filter(Boolean).join(" · ") ?? proc.cmd;
  return {
    label,
    icon: icon,
  };
};

const getIconForCmdArgs = (args: string): Icon | undefined => {
  let icon: Icon | undefined = undefined;

  const systemPrefix = "/System";
  const systemAppsPrefix = "/System/Applications";
  const appsPrefix = "/Applications/";

  if (args.startsWith(systemPrefix)) {
    icon = Icon.Gear;
    args = args.slice(systemPrefix.length);
  } else if (args.startsWith(systemAppsPrefix)) {
    icon = Icon.Gear;
    args = args.slice(systemAppsPrefix.length);
  } else if (args.startsWith(appsPrefix)) {
    icon = Icon.AppWindow;
    args = args.slice(appsPrefix.length);
  }
  return icon;
};

export const truncate = (label: string) => {
  const trimmed = label.trim();
  if (trimmed.length <= LABEL_MAX_CHARS) {
    return trimmed;
  }

  const numHiddenEdgeChars = (trimmed.length - LABEL_MAX_CHARS - 1) / 2;
  if (numHiddenEdgeChars <= 0) {
    return trimmed;
  }

  const start = trimmed.length / 2;
  return trimmed.slice(0, start - numHiddenEdgeChars) + "..." + trimmed.slice(start + numHiddenEdgeChars);
};

export const normalizePath = (path: string) => {
  const homedir = os.homedir();
  return path.startsWith(homedir) ? path.replace(homedir, "~") : path;
};
