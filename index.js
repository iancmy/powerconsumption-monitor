// import modules
const os = require("os");
const readline = require("readline");
const process = require("process");
const { exec } = require("child_process");
const google = require("google-it");

// define constants
const CPU_MODEL = os.cpus()[0].model;
const CPU_CORES = os.cpus().length / 2;

async function main() {
  console.clear();
  let processName, processId;
  const query = [];

  // get process list
  const processList = await getProcessList();
  let filteredItems = [];

  // create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // set default selected option
  let selectedOption = processList[0];
  let selectedIndex = 3;

  // print process list
  printList(processList, selectedIndex);

  // listener for keypresses
  rl.input.on("keypress", (key, info) => {
    let filteredList = [];

    switch (info.name) {
      case "up":
        if (selectedIndex <= 3) return;

        selectedIndex = Math.max(selectedIndex - 1, 0);

        if (query.length > 0) {
          filteredList = [...processList.slice(0, 3), ...filteredItems];

          printList(filteredList, selectedIndex, query.join(""));
          return;
        }

        selectedOption = processList[selectedIndex];
        printList(processList, selectedIndex);
        break;

      case "down":
        if (selectedIndex >= processList.length - 1) return;
        if (query.length > 0 && selectedIndex >= filteredItems.length + 3 - 1)
          return;

        selectedIndex = Math.min(selectedIndex + 1, processList.length - 1);

        if (query.length > 0) {
          filteredList = [...processList.slice(0, 3), ...filteredItems];
          selectedOption = filteredList[selectedIndex];

          printList(filteredList, selectedIndex, query.join(""));
          return;
        }

        selectedOption = processList[selectedIndex];
        printList(processList, selectedIndex);
        break;

      case "return":
        rl.close();

        // get process name and id
        getInfo(selectedOption)
          .then((res) => {
            processName = res[0];
            processId = res[1];

            // start tracking process
            trackProcess(processName, processId);
          })
          .catch((err) => {
            console.error(err);
          });
        break;

      case "backspace":
        if (query.length === 0) return;

        if (query.length === 1) {
          query.pop();
          selectedIndex = 3;
          selectedOption = processList[selectedIndex];

          printList(processList, selectedIndex);
          return;
        }

        query.pop();

        filteredItems = processList.filter((e) =>
          e.toLowerCase().includes(query.join(""))
        );

        if (filteredItems.length === 0) {
          filteredItems = ["No results found."];
        }

        filteredList = [...processList.slice(0, 3), ...filteredItems];

        selectedIndex = 3;
        selectedOption = filteredList[selectedIndex];

        printList(filteredList, selectedIndex, query.join(""));
        break;

      default:
        // for search query
        const input = key?.toLowerCase();

        if (!/^[a-z0-9]$/.test(input) && info.name !== "space") return;

        query.push(input);

        filteredItems = processList
          .slice(3)
          .filter((e) => e.toLowerCase().includes(query.join("")));

        if (filteredItems.length === 0) {
          filteredItems = ["No results found."];
        }

        filteredList = [...processList.slice(0, 3), ...filteredItems];

        selectedIndex = 3;
        selectedOption = filteredList[selectedIndex];

        printList(filteredList, selectedIndex, query.join(""));
        break;
    }
  });
}

function getProcessList() {
  return new Promise((resolve, reject) => {
    exec("tasklist", (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }

      const processList = stdout.split("\n").filter((e) => e !== "");

      resolve(processList);
    });
  });
}

function printList(list, selectedIndex, search = null, itemsToShow = 5) {
  console.clear();
  process.stdout.write("\nSelect a process to track:");

  process.stdout.write("\n\nUse the arrow keys to navigate the list.");

  process.stdout.write(`\nSearch query: ${search || "Type to search..."}`);

  process.stdout.write(`\n${list[0]}`);
  process.stdout.write(`\n${list[1]}`);
  process.stdout.write(`\n${list[2]}`);

  if (
    selectedIndex + itemsToShow >= list.length ||
    list.length - 3 <= itemsToShow
  ) {
    if (list.length - 3 <= itemsToShow) {
      itemsToShow = list.length - 3;
    }

    for (let i = list.length - itemsToShow; i < list.length; i++) {
      if (i === selectedIndex) {
        process.stdout.write(`\n> ${list[i]}`);
      } else {
        process.stdout.write(`\n  ${list[i]}`);
      }
    }

    process.stdout.write(
      "\n=============================== END OF LIST ================================"
    );

    return;
  }

  for (let i = selectedIndex; i < selectedIndex + itemsToShow; i++) {
    if (i === selectedIndex) {
      process.stdout.write(`\n> ${list[i]}`);
    } else {
      process.stdout.write(`\n  ${list[i]}`);
    }
  }

  if (selectedIndex + itemsToShow < list.length) {
    process.stdout.write(
      `\n${list.length - (selectedIndex + itemsToShow)} more items below...`
    );
  } else {
    process.stdout.write(
      "\n=============================== END OF LIST ================================"
    );
  }
}

function getInfo(selectedProcess) {
  return new Promise((resolve, reject) => {
    const arr = selectedProcess.split(" ").filter((e) => e !== "");
    const name = arr[0];
    const pid = arr[1];

    resolve([name, pid]);
  });
}

function getProcessCpuUsage(pid) {
  return new Promise((resolve, reject) => {
    exec(
      `wmic path Win32_PerfFormattedData_PerfProc_Process where "IDProcess=${pid}" get PercentProcessorTime`,
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
        }

        const array = stdout.split("\n");

        const percentProcessorTime = array[1]
          .split(" ")
          .filter((item) => item !== "")[0];

        const cpuUsage = (percentProcessorTime / CPU_CORES).toFixed(2);

        resolve(cpuUsage);
      }
    );
  });
}

function estimateProcessPowerUsage(cpuUsagePercent, TDP) {
  const powerUsage = (TDP * cpuUsagePercent) / 100;

  return powerUsage;
}

async function trackProcess(processName, processId) {
  console.clear();

  // get the TDP of the CPU
  const TDP = await searchTDP(CPU_MODEL);
  const energyConsumptionArray = [];

  process.stdout.write(
    `TDP of ${CPU_MODEL.trim()}: ${TDP}W\nProcess: ${processName}\nPID: ${processId}`
  );
  process.stdout.write("\nPress CTRL + C to stop tracking.\n");

  process.stdout.write(
    "============\t=================\t===================\t=====\n"
  );
  process.stdout.write(
    "Time Elapsed\tEnergy Consumption\tAverage Consumption\tCPU%\n"
  );
  process.stdout.write(
    "============\t=================\t===================\t=====\n"
  );

  setInterval(async () => {
    try {
      // compute the cpu usage of the process
      const cpuUsagePercent = await getProcessCpuUsage(processId);

      // estimate the power usage of the process
      const powerUsage = estimateProcessPowerUsage(cpuUsagePercent, TDP);

      // add the power usage to the array
      energyConsumptionArray.push(powerUsage);

      // compute the average power usage
      const averagePowerUsage =
        energyConsumptionArray.reduce((a, b) => a + b, 0) /
        energyConsumptionArray.length;

      // print the time elapsed since the program started
      process.stdout.write(`\r${process.uptime().toFixed(2)}s`);

      // print the power usage of the process
      process.stdout.write(`\t\t${powerUsage.toFixed(2)}W`);

      // print the average power usage
      process.stdout.write(`\t\t\t${averagePowerUsage.toFixed(2)}W`);

      // print the cpu usage of the process
      process.stdout.write(`\t\t\t${cpuUsagePercent}%`);
    } catch {
      console.log("Process not found.");
      process.exit();
    }
  }, 100);
}

function searchTDP(cpuModel) {
  const query = `TDP of ${cpuModel}`.trim();
  // regex to match the TDP of the CPU
  const tdpRegex = /(\d+)W/;

  return new Promise((resolve, reject) => {
    google({ query })
      .then((results) => {
        let tdp = "unknown";

        for (let i = 0; i < results.length; i++) {
          const tdpMatch = results[i].snippet.match(tdpRegex);

          if (tdpMatch) {
            tdp = parseInt(tdpMatch);
            console.clear();
            resolve(tdp);
            break;
          }

          if (i === results.length - 1) {
            tdp = 65;
            break;
          }
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

main();
