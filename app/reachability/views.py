

from django.shortcuts import render
from rest_framework.views import APIView
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.parsers import JSONParser
from .models import Host, Test
from .serializers import HostSerializer, TestSerializer


class ViewListHosts(APIView):
    """View to list all Hosts in the system."""
    serializer_class = HostSerializer

    def get(self, request):
        hosts = Host.objects.all()
        serializer = HostSerializer(hosts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        serializer = HostSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ViewHostDetail(APIView):
    """Operations for a specific Host entry by ID."""
    serializer_class = HostSerializer

    def get(self, request, id):
        """Retrieve host of specified ID and return serialized response."""
        try:
            host = Host.objects.get(pk=id)
        except Host.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        print(host.lastest_test)
        serializer = HostSerializer(host)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, id):
        """Update host of specified ID and return serialized response."""
        try:
            host = Host.objects.get(pk=id)
        except Host.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = HostSerializer(host, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        """Deletes host of specified ID and no content."""
        try:
            host = Host.objects.get(pk=id)
        except Host.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        host.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ViewListHostTests(APIView):
    """View all Test for a specific Host."""
    serializer_class = TestSerializer

    def get(self, request, id):
        tests = Test.objects.filter(host_id=id).order_by("-timestamp").all()
        serializer = TestSerializer(tests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

