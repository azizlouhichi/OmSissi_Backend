import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

device = "cuda" if torch.cuda.is_available() else "cpu"

model_name = "tiiuae/Falcon3-1B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name).to(device)

# Récupérer les arguments passés depuis Node
character, place, object_, value = sys.argv[1:]

prompt = f"""
Write a short and fun story for a 7-year-old child.
Main character: {character}
Place: {place}
Object: {object_}
Value: {value}
"""

inputs = tokenizer(prompt, return_tensors="pt").to(device)
output = model.generate(
    **inputs,
    max_length=250,
    do_sample=True,
    temperature=0.9,
    top_k=50,
    top_p=0.9,
    repetition_penalty=1.2
)
story = tokenizer.decode(output[0], skip_special_tokens=True)
print(story)
