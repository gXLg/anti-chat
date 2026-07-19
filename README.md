# Anti-Chat
Own your communication. A self-hosted, decentralized messenger
built on Tor with no central servers or accounts.

# Usage
For now, Anti-Chat can run only on `linux-x86_64` and `linux-aarch64`.

1. Install `node.js`, `jq`, `screen` and `git`
2. Make sure your system provides the `file` binary
3. Clone this repository
4. Run `npm ci`
5. Run `./scripts/run-node.sh` to start the node
6. Wait a bit and run `./scripts/node-access.sh` to get your hostname
   and secret
7. To stop the node later, run `./scripts/stop-node.sh`

Do not run the node multiple times! To know whether the node is currently
running, run `screen -ls` and look for `anti-chat-node`.

# Limitations and Restrictions
Your Anti-Chat node has to run and be connected to internet at all times
to be able to receive messages.

All chat members have to trust each other to create a multi-recipient group.

The receiver never acknowledges whether a message was actually processed.
Internet outages on the receiver, the sender or misconfigurations on any end
can lead to message loss.

To make sure that a contact is _able_ (but not guaranteed) to receive
messages, simply open their hostname in the Tor browser. If you see the
Anti-Chat login screen, then the recipients node is running.

Your Anti-Chat node is a "Single Point of Failure":
* If your node shuts down or loses connection, you won't be able
  to send or receive any messages.
* If your node gets compromised, all your chat messages and contacts
  get compromised too. **Keep your node secure!**
