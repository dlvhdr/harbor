import { exec, execSync } from "child_process";

export type Connection = {
  protocol: string;
  localAddress: string;
  remoteAddress: string;
  localPort: string;
  remotePort: string;
};

export type Process = {
  pid: number;
  cmd: string;
  user: string;
  args?: string;
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

export const execLsof = (): Promise<Process[]> => {
  return new Promise<Process[]>((resolve, reject) => {
    exec("lsof -i -Pn -F cPnpLT", { env: { PATH: "/usr/sbin" } }, (error, stdout) => {
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
          const connection = parseConnectionString(connectionString);
          if (connection.localAddress != null || connection.remoteAddress != null) {
            proc.connections = [...proc.connections, connection];
          }
        });

        const psOut = execSync(`ps -o command= -p ${proc.pid}`).toString();
        if (psOut) {
          proc.args = psOut.split("\n")[0].trim();
        }

        return proc;
      });

      resolve(procs);
    });
  });
};
