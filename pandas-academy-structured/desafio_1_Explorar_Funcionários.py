# Explorar Funcionários  |  Nível: Iniciante
# Keywords: head, info

import pandas as pd
import io

data = """nome,idade,salario
Ana,25,5000
Bruno,30,6000
Clara,28,5500
Diego,32,7000
Eva,27,5200"""
df = pd.read_csv(io.StringIO(data))

# --- Seu código ---
print(df.head(3))