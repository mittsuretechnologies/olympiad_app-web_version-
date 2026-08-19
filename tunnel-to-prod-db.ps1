# Opens an SSH tunnel from localhost:5433 to the production Postgres server
# (172.31.30.232, private VPC IP — not reachable directly from outside AWS).
# Routes through the Checker Server, which is already permitted to reach
# the DB on port 5432 per its security group.
#
# Run this FIRST and leave it running in its own terminal, then in another
# terminal run .\use-server-db.ps1 and start the dev server as usual — its
# .env will point at 127.0.0.1:5433.

ssh -i "$HOME\Downloads\Mittsure.pem" -N -L 5433:172.31.30.232:5432 ubuntu@13.205.94.48
