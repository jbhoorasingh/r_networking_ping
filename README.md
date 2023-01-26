## r/Networking Ping
This project was conceived from a Reddit post asking for a tool that can ping multiple multiple host and provide traceroute for each reachability attempt.

### Why not just use an existing NMS product?
1) I hope to make this easy to use and deployable within 5 minutes using docker for ADHOC use
2) I want to learn/brush up on some frontend technology
3) I want to learn/use/practice building stuf with Django
4) I worked at an Org which had something similar done in PowerShell. It very nice to have around for large changes, but it was such a pain to set up. Guys - if you see this and it was simple to use someone is paying for my first race :)
5) What else am I going to do on my weekends? 


## Quick Start: Development
```shell
# Clone repo
git clone urlHere

# Set up python environment
python -m venv venv
source ./venv/bin/activate
pip install -r requirments.txt

# Migrate database - this will create a temp sqlite3 db
python manage.py makemigrations
python manage.py migrate

# Start Celery Worker
python -m celery -A r_networking_ping  worker # you may need to run this as sudo
python -m celery -A r_networking_ping  beat
python -m celery -A r_networking_ping  flower

# set environment
set -o allexport; source .env; set +o allexport

# Start Development Server
python manage.py runserver

```

# Deployment
## Enviromental File
### .env
```shell
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=KeKeDoYouLoveMe_NoIDont
DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
DJANGO_TIME_ZONE=UTC
SQL_ENGINE=django.db.backends.postgresql
SQL_DATABASE=r_networking_ping
SQL_USER=r_networking_ping
SQL_PASSWORD=HelloW0rld2023!
SQL_HOST=db
SQL_PORT=5432
```
### .env.db
Separating out Database so we can easily decouple
```shell
POSTGRES_USER=r_networking_ping # Change if desired. Has to match SQL_USER in .env
POSTGRES_PASSWORD=ChangeMePlease # Please change! Has to match SQL_USER in .env
POSTGRES_DB=r_networking_pingn # Change if desired. Has to match SQL_USER in .env
```
## Quick Start - Docker
Note that this will not work (will not ping) on MacOS, because Docker Desktop for Mac can't route traffic to containers 
### Docker Compose Up
```shell
docker-compose up --build
```
### Docker Compose Migrate Database (First Run or change to DB Models)
```shell
docker-compose run web python3 manage.py migrate
```

[//]: # (```shell)

[//]: # (docker-compose exec db psql --username=hello_django --dbname=hello_django_dev)

[//]: # (docker-compose run web python3 manage.py migrate)

[//]: # ()
[//]: # (```)