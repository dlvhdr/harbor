import { useEffect, useState } from "react";
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

  return (
    <MenuBarExtra icon={Icon.Plug} isLoading={isLoading} title="3000 · 5000 · 1234">
      {procs.map((proc) => (
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
          {proc.connections.map((conn) => (
            <MenuBarExtra.Item
              key={`${conn.localAddress}:${conn.localPort},${conn.remoteAddress}:${conn.remotePort}`}
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
