import { useEffect, useState, useMemo } from "react";
import { Icon, MenuBarExtra, Clipboard, Color, Cache, getPreferenceValues } from "@raycast/api";
import { execLsof, formatConnection, formatShortCmdArgs, formatTitle, Process } from "./procs";
import { execSync } from "child_process";

const CMD_ARGS_MAX_LEN = 40;

const cache = new Cache();

const usePorts = () => {
  const cachedProcs = cache.get("procs");
  const [isLoading, setIsLoading] = useState(true);
  const [procs, setProcs] = useState<Process[]>(cachedProcs ? JSON.parse(cachedProcs) : []);

  useEffect(() => {
    execLsof()
      .then((retProcs) => {
        cache.set("procs", JSON.stringify(retProcs));
        return setProcs(retProcs);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return {
    procs,
    isLoading,
  };
};

type Preferences = {
  hideByArgs: string;
};

export default function Command() {
  const { hideByArgs } = getPreferenceValues<Preferences>();
  const { procs, isLoading } = usePorts();
  const title = useMemo(() => {
    return formatTitle(procs, hideByArgs.split(","));
  }, [procs]);
  const nodeProcs = useMemo(() => {
    return procs
      .filter((p) => p.cmd === "node")
      .slice()
      .sort((p1) => (p1.args != null && hideByArgs.includes(p1.args) ? 1 : -1));
  }, [procs]);
  const otherProcs = useMemo(() => {
    return procs.filter((p) => p.cmd !== "node");
  }, [procs]);

  return (
    <MenuBarExtra icon={Icon.Boat} isLoading={isLoading} title={title}>
      <MenuBarExtra.Section title="Node">
        {nodeProcs.map((proc) => (
          <ProcSubMenu key={proc.pid} proc={proc} />
        ))}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section>
        <MenuBarExtra.Submenu title="Other used ports" icon={Icon.Ellipsis}>
          {otherProcs.map((proc) => (
            <ProcSubMenu key={proc.pid} proc={proc} />
          ))}
        </MenuBarExtra.Submenu>
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

const ProcSubMenu = (props: { proc: Process }) => {
  const { proc } = props;
  return (
    <MenuBarExtra.Submenu title={formatShortCmdArgs(proc)}>
      <MenuBarExtra.Item
        icon={{ source: Icon.Terminal, tintColor: Color.Green }}
        title={
          proc.args && proc.args.length > CMD_ARGS_MAX_LEN
            ? "..." + proc.args.slice(proc.args.length - CMD_ARGS_MAX_LEN)
            : proc.args ?? "No args"
        }
        tooltip={proc.args}
        onAction={() => {
          Clipboard.copy(JSON.stringify(proc, null, 2));
        }}
      />
      <MenuBarExtra.Section title={`Actions · pid ${proc.pid}`}>
        <MenuBarExtra.Item
          title="Terminate"
          onAction={() => {
            execSync(`kill ${proc.pid}`, { killSignal: "SIGTERM", timeout: 2000 });
          }}
        />
        <MenuBarExtra.Item
          title={`Kill`}
          onAction={() => {
            execSync(`kill -9 ${proc.pid}`, { killSignal: "SIGTERM", timeout: 2000 });
          }}
        />
      </MenuBarExtra.Section>
      {proc.connections.length > 0 ? (
        <MenuBarExtra.Section title="Connections (click to copy)">
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
        </MenuBarExtra.Section>
      ) : null}
    </MenuBarExtra.Submenu>
  );
};
