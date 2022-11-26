import { Icon } from "@raycast/api";
import { Connection, Process } from "./procs";

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

const SHORT_CMD_ARGS_LEN = 25;

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

  const formattedArgs =
    (args.length ?? 0) > SHORT_CMD_ARGS_LEN
      ? args.slice(0, 10) + "..." + args.slice(args.length - SHORT_CMD_ARGS_LEN)
      : proc.args;
  let formattedCwd: string | undefined = undefined;
  if (proc.cwd) {
    if (proc.pid === 24663) {
      console.log(proc.cmd, proc.pid, proc.cwd);
    }
    const cwd = proc.cwd;
    formattedCwd =
      (cwd.length ?? 0) > SHORT_CMD_ARGS_LEN
        ? cwd.slice(0, 10) + "..." + cwd.slice(cwd.length - SHORT_CMD_ARGS_LEN)
        : cwd;
  }

  const label = [formattedPorts, formattedArgs, formattedCwd].filter(Boolean).join(" · ") ?? proc.cmd;
  if (proc.pid === 61791) {
    console.log("label", label, proc.cwd);
  }
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
