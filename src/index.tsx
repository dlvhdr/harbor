import { useEffect, useState } from "react";
import { Icon, MenuBarExtra, Clipboard } from "@raycast/api";
import { exec, execSync } from "child_process";

type Port = { name: string; port: string };

type Process = {
  pid: number;
  cmd: string;
  user: string;
  args?: string;
  connections: Connection[];
};

type Connection = {
  protocol: string;
  localAddress: string;
  remoteAddress: string;
  localPort: string;
  remotePort: string;
};

const CMD_ARGS_MAX_LEN = 40;

const usePorts = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<{ output: Process[]; ports: Port[] }>({
    output: [],
    ports: [],
  });
  useEffect(() => {
    (async () => {
      return new Promise<void>((resolve, reject) => {
        exec("lsof -i -Pn -F cPnpLT", { env: { PATH: "/usr/sbin" } }, (error, stdout) => {
          setIsLoading(false);
          if (error) {
            reject(error);
            return;
          }
          const separated = stdout.split("\np");

          const procs = separated.map((p, i) => {
            const procSplit = p.split("\nf");

            const processInfo = procSplit[0].split("\n");
            if (i == 0) {
              // remove first character from the first line in processInfo if we're on index 0
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
              if (connection.localAddress != null || connection.remoteAddress != null) {
                proc.connections = [...proc.connections, connection];
              }
            });

            const psOut = execSync(`ps -o command= -p ${proc.pid}`).toString();
            if (psOut) {
              proc.args = psOut.split("\n")[0];
            }

            return proc;
          });

          setState({
            output: procs,
            ports: [
              {
                name: "node localhost:3000",
                port: "3000",
              },
              {
                name: "node localhost:5000",
                port: "5000",
              },
              {
                name: "node localhost:1234",
                port: "1234",
              },
            ],
          });
          resolve();
        });
      });
    })();
  }, []);

  return {
    ...state,
    isLoading,
  };
};

export default function Command() {
  const { ports, output, isLoading } = usePorts();
  console.debug(
    "wow",
    output.map((o) => o.connections)
  );

  return (
    <MenuBarExtra icon={Icon.Plug} isLoading={isLoading} title="3000 · 5000 · 1234">
      {output.map((proc) => (
        <MenuBarExtra.Submenu key={proc.pid} title={`${proc.cmd} (${proc.pid})`}>
          <MenuBarExtra.Item
            title={
              proc.args && proc.args.length > CMD_ARGS_MAX_LEN
                ? proc.args.slice(0, CMD_ARGS_MAX_LEN) + "..."
                : proc.args ?? "No args"
            }
            tooltip={proc.args}
          />
          {proc.connections.map((conn) => (
            <MenuBarExtra.Item
              key={`${conn.localAddress}:${conn.localPort},${conn.remoteAddress}:${conn.remotePort}`}
              tooltip={JSON.stringify(conn, null, 2)}
              title={formatConnection(conn)}
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
    return `${local} -> ${remote}`;
  }

  return remote ?? local ?? "";
};
