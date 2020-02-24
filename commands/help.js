exports.exec = async args => {
    return `
These shell commands are defined internally.  Type 'help' to see this list.
Type 'help name' to find out more about the function 'name'.
Use 'info bash' to find out more about the shell in general.
Use 'man -k' or 'info' to find out more about commands not in this list.

A star (*) next to a name means that the command is disabled.

 job_spec [&]                                                            history [-c] [-d offset] [n] or history -anrw [filename] or history >
 (( expression ))                                                        if COMMANDS; then COMMANDS; [ elif COMMANDS; then COMMANDS; ]... [ e>
 . filename [arguments]                                                  jobs [-lnprs] [jobspec ...] or jobs -x command [args]
 此处省略
 help [-dms] [pattern ...]                                               { COMMANDS ; }`
}