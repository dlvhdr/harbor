import { useEffect, useState, useMemo } from "react";
import { Icon, MenuBarExtra, Clipboard, Color } from "@raycast/api";
import { Connection, execLsof, Process } from "./utils";

const CMD_ARGS_MAX_LEN = 40;

const usePorts = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [procs, setProcs] = useState<Process[]>([]);

  useEffect(() => {
    execLsof()
      .then((retProcs) => setProcs(retProcs))
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return {
    procs,
    isLoading,
  };
};

export default function Command() {
  const { procs, isLoading } = usePorts();
  const title = useMemo(() => {
    return formatTitle(procs);
  }, [procs]);
  const sortedProcs = useMemo(() => {
    return [...procs].sort((a) => {
      if (a.cmd === "node") {
        return -1;
      }
      return 0;
    });
  }, [procs]);

  return (
    <MenuBarExtra icon={Icon.Plug} isLoading={isLoading} title={title}>
      {sortedProcs.map((proc) => (
        <MenuBarExtra.Submenu key={proc.pid} title={`${proc.cmd} (${proc.pid})`}>
          <MenuBarExtra.Item
            icon={{ source: Icon.Terminal, tintColor: Color.Green }}
            title={
              proc.args && proc.args.length > CMD_ARGS_MAX_LEN
                ? proc.args.slice(0, CMD_ARGS_MAX_LEN) + "..."
                : proc.args ?? "No args"
            }
            tooltip={proc.args}
            onAction={() => {
              Clipboard.copy(JSON.stringify(proc, null, 2));
            }}
          />
          {proc.connections.map((conn, i) => (
            <MenuBarExtra.Item
              key={`${i}_${conn.protocol}_${conn.localAddress}:${conn.localPort},${conn.remoteAddress}:${conn.remotePort}`}
              tooltip={JSON.stringify(conn, null, 2)}
              title={formatConnection(conn)}
              onAction={() => {
                Clipboard.copy(formatConnection(conn));
              }}
            />
          ))}
        </MenuBarExtra.Submenu>
      ))}
    </MenuBarExtra>
  );
}

const formatConnection = (connection: Connection): string => {
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

const formatTitle = (procs: Process[]): string => {
  const nodeProcs = procs
    .filter((p) => p.cmd === "node")
    .filter((p) => {
      return p.args !== "eslint_d" && p.args !== "prettierd";
    });
  return nodeProcs.map((p) => p.connections.flatMap((conn) => conn.remotePort ?? conn.localPort)).join(" · ");
};
