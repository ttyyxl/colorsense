
import torch
import torch.nn as nn
from torchvision import models


class SimpleCNNBackbone(nn.Module):
    def __init__(self, out_dim=256):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.out = nn.Linear(128, out_dim)
        self.out_dim = out_dim

    def forward(self, x):
        x = self.features(x)
        x = torch.flatten(x, 1)
        x = self.out(x)
        return x


class SeasonNet(nn.Module):
    def __init__(
        self,
        base_model="resnet18",
        num_classes=4,
        dropout=0.5,
        use_color_features=True,
        pretrained=False,
        freeze_backbone=False,
    ):
        super().__init__()

        self.base_model = base_model
        self.use_color_features = use_color_features
        self.color_dim = 12 if use_color_features else 0

        if base_model == "simple_cnn":
            self.backbone = SimpleCNNBackbone(out_dim=256)
            img_feat_dim = 256

        elif base_model == "resnet18":
            weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
            self.backbone = models.resnet18(weights=weights)
            img_feat_dim = self.backbone.fc.in_features
            self.backbone.fc = nn.Identity()

        elif base_model == "efficientnet_b0":
            weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
            self.backbone = models.efficientnet_b0(weights=weights)
            img_feat_dim = self.backbone.classifier[1].in_features
            self.backbone.classifier = nn.Identity()

        else:
            raise ValueError(f"Unknown base_model: {base_model}")

        if freeze_backbone:
            for p in self.backbone.parameters():
                p.requires_grad = False

        self.color_branch = nn.Sequential(
            nn.Linear(self.color_dim, 32),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.1),
        ) if use_color_features else None

        fused_dim = img_feat_dim + (32 if use_color_features else 0)

        self.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(fused_dim, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout),
            nn.Linear(128, num_classes),
        )

    def forward(self, x_img, x_color=None):
        img_feat = self.backbone(x_img)

        if self.use_color_features:
            if x_color is None:
                raise ValueError("use_color_features=True but x_color is None")
            color_feat = self.color_branch(x_color)
            feat = torch.cat([img_feat, color_feat], dim=1)
        else:
            feat = img_feat

        return self.classifier(feat)
