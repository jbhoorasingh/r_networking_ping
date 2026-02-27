"""r_networking_ping URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from reachability.views import host_detail_page, hosts_page, results_page

urlpatterns = [
    path('', hosts_page, name='hosts_page'),
    path('results/', results_page, name='results_page'),
    path('host/<int:id>/', host_detail_page, name='host_detail_page'),
    path('admin/', admin.site.urls),
    path('api/', include('reachability.urls')),
]
