import requests

KEV_URL = "https://toronto-nest-calculation-calculations.trycloudflare.com"

r = requests.get(f"{KEV_URL}/v1/models")

print(r.status_code)
print(r.json())