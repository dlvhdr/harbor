import { useExec } from "@raycast/utils";
import { execa } from "execa";
import { useEffect, useMemo, useState } from "react";
import { Cache, getPreferenceValues } from "@raycast/api";
import { onlyLocalPorts } from "./formatters";

export type Connection = {
  protocol: string;
  localAddress: string;
  remoteAddress?: string;
  localPort: string;
  remotePort?: string;
};

export type Process = {
  pid: number;
  cmd: string;
  user: string;
  args?: string;
  cwd?: string;
  connections: Connection[];
};

const parseConnectionString = (connectionString: string): Connection => {
  const connection = {} as Connection;
  const connectionInfo = connectionString.split("\n");
  connectionInfo
    .filter((prop) => prop.length > 0)
    .forEach((connectionProperty) => {
      switch (connectionProperty[0]) {
        case "P":
          connection.protocol = connectionProperty.slice(1);
          break;
        case "n": {
          if (connectionProperty.slice(1) === "*:*") {
            return;
          }

          const splitLocalAndRemote = connectionProperty.slice(1).split("->");
          if (splitLocalAndRemote.length > 1) {
            const splitLocalAddressAndPort = splitLocalAndRemote[0].split(":");
            const splitRemoteAddressAndPort = splitLocalAndRemote[1].split(":");

            connection.localAddress = splitLocalAddressAndPort[0];
            connection.localPort = splitLocalAddressAndPort[1];
            connection.remoteAddress = splitRemoteAddressAndPort[0];
            connection.remotePort = splitRemoteAddressAndPort[1];
          } else {
            const splitLocalAddressAndPort = splitLocalAndRemote[0].split(":");
            connection.localAddress = splitLocalAddressAndPort[0];

            // As localPort is a string, we can handle ports like '*' without conversions.
            connection.localPort = splitLocalAddressAndPort[1];
          }
          break;
        }
      }
    });
  return connection;
};

const cache = new Cache();

export const useLsof = (): {
  wow: string | undefined;
  procs: Process[];
  revalidate: () => void;
  isLoading: boolean;
} => {
  const { isLoading, data, revalidate } = useExec("/usr/sbin/lsof", ["-i", "-Pn", "-F", "cPnpLT"], {
    keepPreviousData: false,
  });
  const cached = cache.get("procs");
  const [outProcs, setOutProcs] = useState<Process[]>(cached ? JSON.parse(cached) : []);

  useEffect(() => {
    async function getProcs() {
      if (!data) {
        return;
      }
      const separated = data.toString().split("\np");
      const procs = separated?.map((p, i) => {
        const procSplit = p.split("\nf");

        const processInfo = procSplit[0].split("\n");
        if (i == 0) {
          processInfo[0] = processInfo[0].slice(1);
        }
        const pid = Number(processInfo[0]);
        const cmd = processInfo[1].slice(1);
        const user = processInfo[2].slice(1);
        const proc: Process = {
          pid,
          cmd,
          user,
          connections: [],
        };
        procSplit.slice(1).map((connectionString) => {
          const connection = parseConnectionString(connectionString);
          if (connection.localAddress != null || connection.remoteAddress != null) {
            proc.connections = [...proc.connections, connection];
          }
        });
        return proc;
      });
      const args = await getAllArgs(procs.map((p) => p.pid));
      procs.forEach((proc) => {
        proc.args = args[proc.pid];
      });
      cache.set("procs", JSON.stringify(procs));
      setOutProcs(procs);
    }
    getProcs();
  }, [data]);

  return {
    isLoading: isLoading,
    revalidate,
    procs: outProcs,
    wow: "",
  };
};

export const getCwd = async (pid: number): Promise<string> => {
  try {
    const lsof = execa("/usr/sbin/lsof", ["-p", String(pid), "-F", "n"], {
      timeout: 1000,
      killSignal: "SIGKILL",
    });
    const { stdout } = await lsof;
    const rows = stdout.split("\n");
    let foundPid: string | undefined = undefined;
    let cwd = "";
    rows.forEach((row, i) => {
      if (row.startsWith("p")) {
        foundPid = row.slice(1);
      }
      if (row !== "fcwd") {
        return;
      }
      if (foundPid) {
        cwd = rows[i + 1].slice(1);
      }
    });
    return cwd;
  } catch (e) {
    console.error("error", e);
  }
  return "";
};

const getAllArgs = async (pids: number[]): Promise<{ [pid: string]: string | undefined }> => {
  const procsArgs: { [pid: string]: string | undefined } = {};
  const { stdout: psOut } = await execa("ps", ["-o", "pid=", "-o", "command=", "-p", pids.join(",")]);
  psOut.split("\n").map((args) => {
    const firstSpaceIdx = args.trimStart().indexOf(" ");
    const split = [args.trimStart().slice(0, firstSpaceIdx), args.trimStart().slice(firstSpaceIdx + 1)];
    if (split.length < 2) {
      return;
    }
    const [pid, command] = split;
    procsArgs[pid] = command.trim() === "" ? undefined : command;
  });
  return procsArgs;
};

export const useProcSections = (
  procs: Process[]
): {
  shownNodeProcs: Process[];
  hiddenNodeProcs: Process[];
  otherLocalProcs: Process[];
  otherExternalProcs: Process[];
} => {
  const { hideByArgs } = getPreferenceValues<{ hideByArgs: string }>();

  const allNodeProcs = useMemo(() => procs.filter((p) => p.cmd === "node"), [procs]);
  const shownNodeProcs = useMemo(() => {
    return allNodeProcs.filter((p) => p.args == null || !hideByArgs.includes(p.args.trim()));
  }, [allNodeProcs]);
  const hiddenNodeProcs = useMemo(() => {
    return allNodeProcs.filter((p) => p.args != null && hideByArgs.includes(p.args.trim()));
  }, [allNodeProcs]);

  const otherProcs = useMemo(() => procs.filter((p) => p.cmd !== "node"), [procs]);
  const otherLocalProcs = useMemo(() => {
    return otherProcs.filter((p) => p.connections.length > 0 && p.connections.some(onlyLocalPorts));
  }, [otherProcs]);
  const otherExternalProcs = useMemo(() => {
    return otherProcs.filter((p) => p.connections.length > 0 && p.connections.every((conn) => !onlyLocalPorts(conn)));
  }, [otherProcs]);

  return {
    shownNodeProcs,
    hiddenNodeProcs,
    otherLocalProcs,
    otherExternalProcs,
  };
};
