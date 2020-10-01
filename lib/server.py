from http.server import HTTPServer, BaseHTTPRequestHandler
import re
import json

import torch
from PIL import Image
from torchvision import transforms

model = torch.hub.load('RF5/danbooru-pretrained', 'resnet50')
model.eval()
if torch.cuda.is_available():
    model.to('cuda')
preprocess = transforms.Compose([
    transforms.Resize(360),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.7137, 0.6628, 0.6519], std=[0.2970, 0.3017, 0.2979])
])
filter = lambda a: a[a > 0.5]
tensorStr = lambda a: str(a)

class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        ipt = json.loads(body)
        print(ipt)
        try:
            image = Image.open(ipt['path'])
            input_tensor = preprocess(image)
            input_batch = input_tensor.unsqueeze(0)
            if torch.cuda.is_available():
                input_batch = input_batch.to('cuda')
            output = model(input_batch)
            probs = torch.sigmoid(output[0])
            tmp = probs[probs > 0.5]
            inds = probs.argsort(descending=True)
            tags = list()
            for i in inds[0: len(tmp)]:
                tags.append([int(re.sub("\D", "", str(i))), float(probs[i].detach().numpy())])
        except Exception as e:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(str.encode(str(e)))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(str.encode(json.dumps(tags)))

httpd = HTTPServer(('127.0.0.1', 10377), SimpleHTTPRequestHandler)
httpd.serve_forever()
