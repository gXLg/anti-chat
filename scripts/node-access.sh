#!/bin/bash

echo "This is your node's onion address:"
cat ./data/onion/hostname

echo

echo "Login using the following secret:"
cat ./data/identity.json | jq -r .secret
