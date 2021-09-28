import ChildProcess from 'child_process'
import fs from 'fs'
import CommandLineArgs from 'command-line-args'

const optionDefinitions = [
  {name: 'filename', alias: 'f', type: String, defaultValue: 'dockerPortMapping.json'},
  {name: 'container', alias: 'c', type: String, defaultValue: 'conalog'},
  {name: 'password', alias: 'k', type: String, defaultValue: 'root'}
]
const options = CommandLineArgs(optionDefinitions)
console.log(options)

let json = {dockerPortMapping: {}}

let proc = ChildProcess.exec('sudo -S docker port ' + options.container, (err, stdout, stderr) => {
  if (err) {
    console.log(err.stack)
  }

  if (stdout) {
    let lines = stdout.toString().split("\n")
    lines.map(line => {
      if (line.length > 1) {
        let parts = line.split(" -> ")
        let dockerParts = parts[0].split("/")
        let hostParts = parts[1].split(":")
        json.dockerPortMapping[parseInt(dockerParts[0])] = {
          protocol: dockerParts[1],
          host: hostParts[0],
          hostPort: parseInt(hostParts[1])
        }
      }
    })

    console.log(json)
    fs.writeFile(options.filename, JSON.stringify(json), err => {
      if (err)
        console.log(err)

      console.log('Docker port mapping has been writen to ' + options.filename)
    })
  }

  if (stderr) {
    console.log(stderr.toString())
  }
})

proc.stdin.write(options.password + "\n")
